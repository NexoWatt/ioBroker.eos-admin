"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipEndpoint = void 0;
const node_https_1 = require("node:https");
const certificateIdentity_1 = require("./certificateIdentity");
const sanitizer_1 = require("./sanitizer");
const shipFrames_1 = require("./shipFrames");
const SHIP_WEBSOCKET_PROTOCOL = 'ship';
class ShipEndpoint {
    adapter;
    config;
    identity;
    onMessage;
    onNode;
    onState;
    onDataExchange;
    onPairingRequest;
    isTrusted;
    server;
    wss;
    bonjour;
    advertisement;
    sockets = new Map();
    sessions = new Map();
    stopping = false;
    registering = new Set();
    queuedBytes = 0;
    serverConnections = new Set();
    connecting = new Map();
    constructor(adapter, config, identity, onMessage, onNode, onState, onDataExchange, onPairingRequest, isTrusted) {
        this.adapter = adapter;
        this.config = config;
        this.identity = identity;
        this.onMessage = onMessage;
        this.onNode = onNode;
        this.onState = onState;
        this.onDataExchange = onDataExchange;
        this.onPairingRequest = onPairingRequest;
        this.isTrusted = isTrusted;
    }
    async start() {
        this.stopping = false;
        if (!this.config.shipServerEnabled) {
            this.adapter.log.info('Local EOS/HEMS SHIP endpoint is disabled. Wallboxes cannot pair with EOS through EEBUS.');
            return false;
        }
        let WebSocketServer;
        try {
            ({ WebSocketServer } = require('ws'));
        }
        catch (error) {
            this.adapter.log.warn(`ws is not available. Local SHIP endpoint cannot start until dependencies are installed: ${String(error)}`);
            return false;
        }
        return new Promise(resolve => {
            try {
                this.server = (0, node_https_1.createServer)({
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
                this.server.on('request', (_request, response) => { response.writeHead(404); response.end(); });
                this.server.on('connection', (socket) => { this.serverConnections.add(socket); socket.once('close', () => this.serverConnections.delete(socket)); });
                this.wss = new WebSocketServer({
                    server: this.server,
                    path: this.config.shipPath,
                    perMessageDeflate: false,
                    maxPayload: 262144,
                    handleProtocols: (protocols) => (protocols.has(SHIP_WEBSOCKET_PROTOCOL) ? SHIP_WEBSOCKET_PROTOCOL : false),
                });
                this.wss.on('connection', (socket, request) => {
                    this.background(this.registerSocket(socket, request, 'server'), socket);
                });
                this.server.on('error', (error) => {
                    this.adapter.log.warn(`Local EOS/HEMS SHIP endpoint could not listen on port ${this.config.shipPort}: ${error.message}`);
                    resolve(false);
                });
                this.server.listen(this.config.shipPort, () => {
                    const address = this.server.address();
                    this.adapter.log.info(`Local EOS/HEMS SHIP endpoint listening on port ${address.port}${this.config.shipPath}`);
                    this.publishMdnsIfEnabled(address.port);
                    resolve(true);
                });
            }
            catch (error) {
                this.adapter.log.warn(`Local EOS/HEMS SHIP endpoint could not start: ${String(error)}`);
                resolve(false);
            }
        });
    }
    async connectToNode(node) {
        if (this.stopping || this.sessions.size + this.connecting.size >= 32)
            return false;
        if (!this.config.autoConnectEnabled)
            return false;
        if (!node.host || !node.port)
            return false;
        if (this.sessions.has(node.safeId) || this.connecting.has(node.safeId))
            return true;
        if (node.ski && node.ski === this.identity.localSki)
            return false;
        if (node.id && node.id === this.identity.shipId)
            return false;
        let WebSocket;
        try {
            WebSocket = require('ws');
        }
        catch (error) {
            this.adapter.log.warn(`ws is not available. Cannot connect to EEBUS node ${node.safeId}: ${String(error)}`);
            return false;
        }
        if (!/^[A-Fa-f0-9]{40}$/.test(node.ski) || !Number.isInteger(node.port) || node.port < 1024 || node.port > 65535)
            return false;
        const path = node.path || '/ship/';
        if (!/^\/[A-Za-z0-9/_-]{0,63}$/.test(path))
            return false;
        const url = `wss://${addressForUrl(node.host)}:${node.port}${path}`;
        await this.onState(node.safeId, 'connecting', 'client', false);
        if (this.stopping || this.adapter.canOperate?.() === false || this.sessions.size + this.connecting.size >= 32 || this.sessions.has(node.safeId) || this.connecting.has(node.safeId))
            return false;
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
                socket.once('close', () => { if (this.connecting.get(node.safeId) === socket)
                    this.connecting.delete(node.safeId); });
                socket.once('open', () => {
                    this.connecting.delete(node.safeId);
                    const peer = getPeerIdentity({ socket: socket._socket });
                    if (this.stopping || !peer.ski || peer.ski !== node.ski.toUpperCase() || !peer.fingerprint) {
                        socket.terminate();
                        resolve(false);
                        return;
                    }
                    const session = {
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
                    this.sendFrame(session, (0, shipFrames_1.encodeCmiFrame)());
                    this.background(this.onNode({ ...node, fingerprint: peer.fingerprint }), socket);
                    this.background(this.setSessionState(session, 'tls-connected', true), socket);
                    resolve(true);
                });
                socket.once('error', (error) => {
                    this.adapter.log.debug(`Could not open SHIP client connection to ${node.safeId} (${url}): ${error.message}`);
                    this.connecting.delete(node.safeId);
                    this.background(this.onState(node.safeId, 'error', 'client', false, 'EEBUS_CONNECT_ERROR'));
                    resolve(false);
                });
            }
            catch (error) {
                this.background(this.onState(node.safeId, 'error', 'client', false, 'EEBUS_CONNECT_ERROR'));
                resolve(false);
            }
        });
    }
    send(deviceId, payload) {
        return this.sendSpine(deviceId, payload);
    }
    sendSpine(deviceId, payload) {
        const session = this.sessions.get(deviceId);
        if (!session || !this.isSocketOpen(session.socket) || !session.dataExchangeReady || !session.authorized || this.stopping || this.adapter.canOperate?.() === false) {
            return false;
        }
        this.sendFrame(session, (0, shipFrames_1.encodeDataFrame)(payload));
        return true;
    }
    disconnect(deviceId) {
        const session = this.sessions.get(deviceId);
        if (!session)
            return false;
        try {
            if (this.isSocketOpen(session.socket))
                this.sendFrame(session, (0, shipFrames_1.encodeEndFrame)('unspecific'));
            session.authorized = false;
            session.socket.terminate?.();
            return true;
        }
        catch (error) {
            this.adapter.log.debug(`Could not disconnect ${deviceId}: ${String(error)}`);
            return false;
        }
    }
    invalidateCertificate(deviceId, fingerprint) {
        const session = this.sessions.get(deviceId);
        if (session && fingerprint !== session.remoteFingerprint)
            this.disconnect(deviceId);
    }
    hasObservedPeer(deviceId) {
        const session = this.sessions.get(deviceId);
        return !!session?.remoteFingerprint && this.isSocketOpen(session.socket);
    }
    async approveDevice(deviceId) {
        const session = this.sessions.get(deviceId);
        if (!session || !session.remoteFingerprint || !this.isSocketOpen(session.socket))
            throw new Error('EEBUS_NO_OBSERVED_PEER');
        await this.adapter.setStateAsync(`devices.${deviceId}.pairing.pinnedFingerprint`, { val: session.remoteFingerprint, ack: true });
        await this.sendHelloForTrust(session);
    }
    rejectDevice(deviceId) {
        const session = this.sessions.get(deviceId);
        if (!session)
            return;
        this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makeHello)('aborted')));
        this.disconnect(deviceId);
    }
    async stop() {
        this.stopping = true;
        for (const socket of this.registering)
            socket.terminate?.();
        this.registering.clear();
        for (const socket of this.wss?.clients || [])
            socket.terminate?.();
        for (const socket of this.connecting.values())
            socket.terminate?.();
        this.connecting.clear();
        for (const session of this.sessions.values()) {
            try {
                if (this.isSocketOpen(session.socket))
                    this.sendFrame(session, (0, shipFrames_1.encodeEndFrame)('unspecific'));
                if (session.handshakeTimer)
                    clearTimeout(session.handshakeTimer);
                session.authorized = false;
                session.socket.terminate();
            }
            catch (error) {
                this.adapter.log.debug(`Could not close SHIP socket: ${String(error)}`);
            }
        }
        this.sessions.clear();
        this.sockets.clear();
        try {
            this.advertisement?.stop?.();
        }
        catch (error) {
            this.adapter.log.debug(`Could not stop SHIP mDNS advertisement: ${String(error)}`);
        }
        try {
            this.bonjour?.destroy?.();
        }
        catch (error) {
            this.adapter.log.debug(`Could not destroy SHIP mDNS advertiser: ${String(error)}`);
        }
        if (this.wss) {
            await new Promise(resolve => this.wss.close(() => resolve()));
            this.wss = undefined;
        }
        for (const socket of this.serverConnections)
            socket.destroy();
        this.serverConnections.clear();
        if (this.server) {
            this.server.closeAllConnections?.();
            await new Promise(resolve => this.server.close(() => resolve()));
            this.server = undefined;
        }
    }
    async registerSocket(socket, request, role) {
        const peer = getPeerIdentity(request);
        if (this.stopping || this.sessions.size + this.registering.size + this.connecting.size >= 32 || !peer.ski || !peer.fingerprint || socket.protocol !== 'ship') {
            socket.terminate();
            return;
        }
        const safe = (0, sanitizer_1.safeId)(peer.ski || peer.fingerprint || peer.remoteAddress || 'incoming');
        const node = {
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
        const session = {
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
            if (!this.stopping && this.sessions.get(safe) === session)
                await this.setSessionState(session, 'tls-connected', true);
        }).catch(() => { this.adapter.log.warn('EEBUS_PEER_REGISTRATION_FAILED'); this.disconnect(safe); });
    }
    attachSession(session) {
        const previous = this.sessions.get(session.deviceId);
        if (previous)
            this.disconnect(previous.deviceId);
        session.handshakeTimer = setTimeout(() => this.disconnect(session.deviceId), 120000);
        session.handshakeTimer.unref?.();
        this.sessions.set(session.deviceId, session);
        this.sockets.set(session.deviceId, session.socket);
        if (session.remoteSki)
            this.sockets.set((0, sanitizer_1.safeId)(session.remoteSki), session.socket);
        if (session.remoteFingerprint)
            this.sockets.set((0, sanitizer_1.safeId)(session.remoteFingerprint), session.socket);
        session.socket.on('message', (data) => {
            if (this.stopping || (session.pendingFrames || 0) >= 8 || data.length > 262144 || this.queuedBytes + data.length > 8388608) {
                this.disconnect(session.deviceId);
                return;
            }
            session.pendingFrames = (session.pendingFrames || 0) + 1;
            this.queuedBytes += data.length;
            session.work = (session.work || Promise.resolve()).then(async () => {
                if (this.sessions.get(session.deviceId) === session && !this.stopping)
                    await this.handleFrame(session, (0, shipFrames_1.decodeShipFrame)(data));
            }).catch(() => { this.adapter.log.warn('EEBUS_FRAME_REJECTED'); this.disconnect(session.deviceId); })
                .finally(() => { session.pendingFrames = (session.pendingFrames || 1) - 1; this.queuedBytes -= data.length; });
        });
        session.socket.on('close', () => {
            if (session.handshakeTimer)
                clearTimeout(session.handshakeTimer);
            if (this.sessions.get(session.deviceId) !== session)
                return;
            this.sessions.delete(session.deviceId);
            this.sockets.delete(session.deviceId);
            if (session.remoteSki)
                this.sockets.delete((0, sanitizer_1.safeId)(session.remoteSki));
            if (session.remoteFingerprint)
                this.sockets.delete((0, sanitizer_1.safeId)(session.remoteFingerprint));
            this.background(this.setSessionState(session, 'closed', false));
            this.adapter.log.info(`SHIP WebSocket disconnected from ${session.deviceId}`);
        });
        session.socket.on('error', (error) => {
            this.background(this.setSessionState(session, 'error', false, 'EEBUS_SOCKET_ERROR'));
            this.adapter.log.warn(`SHIP WebSocket error from ${session.deviceId}: ${error.message}`);
        });
        this.adapter.log.info(`SHIP WebSocket ${session.role} connected with ${session.deviceId}`);
    }
    async handleFrame(session, frame) {
        if (this.stopping || this.adapter.canOperate?.() === false) {
            this.disconnect(session.deviceId);
            return;
        }
        if (frame.type === 'unknown' || frame.type === 'json')
            throw new Error('EEBUS_FRAME_TYPE');
        if (frame.type === 'init') {
            if (session.cmiComplete || frame.value?.cmiHead !== 0)
                throw new Error('EEBUS_CMI_ORDER');
            session.cmiComplete = true;
            if (session.role === 'server')
                this.sendFrame(session, (0, shipFrames_1.encodeCmiFrame)());
            await this.setSessionState(session, 'cmi-ok', true);
            await this.sendHelloForTrust(session);
            return;
        }
        if (frame.type === 'control') {
            await this.handleControl(session, frame.value);
            return;
        }
        if (frame.type === 'data') {
            if (!session.dataExchangeReady || !(await this.sessionTrusted(session)))
                throw new Error('EEBUS_DATA_BEFORE_TRUST');
            await this.onMessage(session.deviceId, frame.value);
            return;
        }
        if (frame.type === 'end') {
            this.disconnect(session.deviceId);
        }
    }
    async handleControl(session, value) {
        const rec = value && typeof value === 'object' ? value : {};
        if (rec.connectionHello) {
            if (!session.cmiComplete)
                throw new Error('EEBUS_HELLO_BEFORE_CMI');
            const phase = String(rec.connectionHello.phase || '');
            if (!['ready', 'pending', 'aborted'].includes(phase))
                throw new Error('EEBUS_HELLO_PHASE');
            if (phase === 'aborted') {
                this.disconnect(session.deviceId);
                return;
            }
            session.remoteHelloReady = phase === 'ready';
            await this.setSessionState(session, phase === 'ready' ? 'hello-ready' : 'hello-pending', true);
            if (phase !== 'ready')
                await this.onPairingRequest(session.deviceId, { remoteHello: rec.connectionHello, deviceId: session.deviceId });
            if (!session.localHelloReady)
                await this.sendHelloForTrust(session);
            if (session.remoteHelloReady && session.localHelloReady)
                await this.startProtocolHandshake(session);
            return;
        }
        if (rec.messageProtocolHandshake) {
            if (!session.localHelloReady || !session.remoteHelloReady || !(await this.sessionTrusted(session)))
                throw new Error('EEBUS_HANDSHAKE_ORDER');
            const protocol = rec.messageProtocolHandshake;
            if (protocol.version?.major !== 1 || !Array.isArray(protocol.formats?.format) || !protocol.formats.format.includes('JSON-UTF8'))
                throw new Error('EEBUS_PROTOCOL_UNSUPPORTED');
            const handshakeType = String(rec.messageProtocolHandshake.handshakeType || '');
            if (session.role === 'server' && handshakeType === 'announceMax') {
                this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makeProtocolHandshake)('select')));
                return;
            }
            if (session.role === 'client' && handshakeType === 'select') {
                this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)(rec));
                await this.protocolHandshakeOk(session);
                return;
            }
            if (session.role === 'server' && handshakeType === 'select') {
                await this.protocolHandshakeOk(session);
                return;
            }
        }
        if (rec.connectionPinState) {
            if (!session.protocolSelected)
                throw new Error('EEBUS_PIN_ORDER');
            const pinState = String(rec.connectionPinState.pinState || 'none');
            await this.onMessage(session.deviceId, { pinState: rec.connectionPinState });
            if (pinState === 'required') {
                await this.setSessionState(session, 'pin-required', true);
                if (this.config.pairingPin) {
                    this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makePinInput)(this.config.pairingPin)));
                }
                return;
            }
            if (pinState === 'optional' && this.config.pairingPin && rec.connectionPinState.inputPermission === 'ok') {
                this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makePinInput)(this.config.pairingPin)));
                return;
            }
            if (pinState === 'pinOk' || pinState === 'none' || pinState === 'optional') {
                if (this.config.pairingPin && pinState !== 'pinOk')
                    return;
                // The peer acknowledging our PIN is not proof that it knows our local PIN.
                if (this.config.pairingPin && !session.pinAccepted)
                    return;
                await this.enterDataExchange(session);
                return;
            }
        }
        if (rec.connectionPinInput) {
            if (!session.protocolSelected)
                throw new Error('EEBUS_PIN_ORDER');
            const pin = String(rec.connectionPinInput.pin || '');
            if (!this.config.pairingPin || pin === this.config.pairingPin) {
                session.pinAccepted = true;
                this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makePinState)('pinOk')));
                await this.enterDataExchange(session);
            }
            else {
                this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makePinError)(1)));
            }
            return;
        }
        if (rec.connectionPinError) {
            await this.setSessionState(session, 'error', true, `Remote PIN error ${JSON.stringify(rec.connectionPinError)}`);
            return;
        }
        await this.onMessage(session.deviceId, { unhandledControl: rec });
    }
    async sendHelloForTrust(session) {
        if (!session.cmiComplete)
            return;
        const trusted = await this.sessionTrusted(session);
        if (trusted) {
            session.localHelloReady = true;
            this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makeHello)('ready')));
            await this.setSessionState(session, 'hello-ready', true);
            if (session.remoteHelloReady)
                await this.startProtocolHandshake(session);
        }
        else {
            this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makeHello)('pending', 120000)));
            await this.setSessionState(session, 'hello-pending', true);
            await this.onPairingRequest(session.deviceId, {
                deviceId: session.deviceId,
                remoteSki: session.remoteSki,
                remoteFingerprint: session.remoteFingerprint,
                message: 'Set devices.<id>.pairing.trusted=true or press approve to continue SHIP hello.',
            });
        }
    }
    async startProtocolHandshake(session) {
        if (session.protocolSelected)
            return;
        if (session.role === 'client') {
            this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makeProtocolHandshake)('announceMax')));
        }
        // The server waits for the client's announceMax according to the SHIP protocol.
    }
    async protocolHandshakeOk(session) {
        session.protocolSelected = true;
        await this.setSessionState(session, 'protocol-handshake-ok', true);
        this.sendFrame(session, (0, shipFrames_1.encodeControlFrame)((0, shipFrames_1.makePinState)(this.config.pairingPin ? 'required' : 'none', this.config.pairingPin ? 'ok' : undefined)));
        if (!this.config.pairingPin)
            await this.enterDataExchange(session);
    }
    async enterDataExchange(session) {
        if (session.dataExchangeReady)
            return;
        if ((this.config.pairingPin && !session.pinAccepted) || !session.protocolSelected || !session.localHelloReady || !session.remoteHelloReady || !(await this.sessionTrusted(session)))
            throw new Error('EEBUS_DATA_EXCHANGE_ORDER');
        if (session.handshakeTimer)
            clearTimeout(session.handshakeTimer);
        session.authorized = true;
        session.dataExchangeReady = true;
        await this.setSessionState(session, 'data-exchange', true);
        await this.onDataExchange(session.deviceId);
    }
    async setSessionState(session, state, connected, error = '') {
        session.state = state;
        await this.onState(session.deviceId, state, session.role, connected, error);
    }
    sendFrame(session, frame) {
        if (!this.isSocketOpen(session.socket) || this.stopping || this.adapter.canOperate?.() === false)
            return;
        if (session.socket.bufferedAmount > 1048576) {
            this.disconnect(session.deviceId);
            return;
        }
        try {
            session.socket.send(frame);
        }
        catch {
            session.socket.terminate?.();
            this.adapter.log.warn('EEBUS_SEND_FAILED');
        }
    }
    async sessionTrusted(session) {
        if (!session.remoteFingerprint || !(await this.isTrusted(session.deviceId)))
            return false;
        const pin = await this.adapter.getStateAsync(`devices.${session.deviceId}.pairing.pinnedFingerprint`);
        return pin?.val === session.remoteFingerprint && this.isSocketOpen(session.socket) && !this.stopping && this.sessions.get(session.deviceId) === session && this.adapter.canOperate?.() !== false;
    }
    background(work, socket) {
        Promise.resolve(work).catch(() => {
            this.adapter.log.warn('EEBUS_ASYNC_OPERATION_FAILED');
            socket?.terminate?.();
        });
    }
    isSocketOpen(socket) {
        return socket && socket.readyState === 1;
    }
    publishMdnsIfEnabled(port) {
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
            this.adapter.log.info(`Local EOS/HEMS SHIP service announced as "${this.config.serviceName}" via _ship._tcp ` +
                `(brand=${this.config.brand}, model=${this.config.model}, type=${this.config.deviceType}, ski=${this.identity.localSki}).`);
        }
        catch (error) {
            this.adapter.log.warn(`Could not announce local EOS/HEMS SHIP service via mDNS: ${String(error)}`);
        }
    }
}
exports.ShipEndpoint = ShipEndpoint;
function getPeerIdentity(request) {
    const remoteAddress = String(request?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    try {
        const raw = request?.socket?.getPeerCertificate?.(true)?.raw;
        if (!raw)
            throw new Error('EEBUS_PEER_CERT_REQUIRED');
        const identity = (0, certificateIdentity_1.certificateIdentity)(raw);
        return { ski: identity.ski, fingerprint: identity.fingerprint, remoteAddress };
    }
    catch {
        return { ski: '', fingerprint: '', remoteAddress };
    }
}
function addressForUrl(host) {
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}
