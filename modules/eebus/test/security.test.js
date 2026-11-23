'use strict';

// Independent behavioral security regression tests. All test identities are
// generated in a temporary directory; no private production key is a fixture.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { X509Certificate } = require('node:crypto');
const { certificateIdentity, validateKeyPair } = require('../build/lib/certificateIdentity');

const fixtureDir = mkdtempSync(join(tmpdir(), 'eos-eebus-security-'));
process.once('exit', () => rmSync(fixtureDir, { recursive: true, force: true }));
function openssl(args) {
    return execFileSync('openssl', args, { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function makeIdentity(name, curve = 'prime256v1') {
    const keyFile = join(fixtureDir, `${name}.key`);
    const certFile = join(fixtureDir, `${name}.crt`);
    openssl(['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', `ec_paramgen_curve:${curve}`, '-nodes', '-sha256', '-days', '2',
        '-subj', `/CN=${name}`, '-addext', 'subjectKeyIdentifier=hash', '-keyout', keyFile, '-out', certFile]);
    const certificate = readFileSync(certFile, 'utf8');
    const privateKey = readFileSync(keyFile, 'utf8');
    const output = openssl(['x509', '-in', certFile, '-noout', '-ext', 'subjectKeyIdentifier']);
    const ski = output.match(/Subject Key Identifier:\s*\n\s*([0-9A-F:]+)/)[1].replace(/:/g, '');
    const fingerprint = new X509Certificate(certificate).fingerprint256.replace(/:/g, '');
    return { certificate, privateKey, localSki: ski, ski, fingerprint, certificateFingerprint: fingerprint, shipId: `i:0_u:${name}` };
}
const local = makeIdentity('local');
const peer = makeIdentity('peer');
const replacement = makeIdentity('replacement');

test('EEBUS-CERT-001: certificate SKI matches actual OpenSSL SKI extension, not a hash of SPKI headers', () => {
    const identity = certificateIdentity(peer.certificate);
    assert.equal(identity.ski, peer.ski);
    assert.equal(identity.fingerprint, peer.fingerprint);
    assert.equal(validateKeyPair(peer.certificate, peer.privateKey).ski, peer.ski);
});

test('EEBUS-CERT-002: mismatched private keys, malformed certificates and oversized input fail closed', () => {
    assert.throws(() => validateKeyPair(peer.certificate, replacement.privateKey), /EEBUS_IDENTITY_KEY_MISMATCH/);
    assert.throws(() => certificateIdentity('not a certificate'));
    assert.throws(() => certificateIdentity('x'.repeat(32769)), /EEBUS_CERT_SIZE/);
});

test('EEBUS-CERT-003: unsupported curve and expired certificate are rejected', () => {
    const unsupported = makeIdentity('unsupported', 'secp384r1');
    assert.throws(() => certificateIdentity(unsupported.certificate), /EEBUS_CERT_CURVE/);
    const originalNow = Date.now;
    try {
        Date.now = () => Date.parse(new X509Certificate(peer.certificate).validTo) + 1000;
        assert.throws(() => certificateIdentity(peer.certificate), /EEBUS_CERT_TIME/);
    } finally {
        Date.now = originalNow;
    }
});

// More SHIP boundary tests below use the compiled endpoint and actual loopback
// TLS/WebSocket connections. They verify observable application delivery rather
// than treating a trust flag or a mocked TLS handshake as identity evidence.

const { ShipEndpoint } = require('../build/lib/shipEndpoint');
const { getConfig } = require('../build/lib/config');
const { encodeCmiFrame, encodeControlFrame, encodeDataFrame, makeHello, makeProtocolHandshake, makePinState } = require('../build/lib/shipFrames');
const WebSocket = require('ws');
async function until(predicate, description, timeoutMs = 2000) {
    const deadline = performance.now() + timeoutMs;
    while (!predicate()) {
        if (performance.now() >= deadline) throw new Error(`Timed out: ${description}`);
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}
async function fixture(t, options = {}) {
    const states = new Map();
    const trusted = new Set();
    const observed = [];
    const delivered = [];
    const ready = [];
    let enabled = true;
    const adapter = {
        log: { info() {}, warn() {}, debug() {}, error() {} },
        canOperate: () => enabled,
        getStateAsync: async id => states.get(id) || null,
        setStateAsync: async (id, state) => { states.set(id, state); },
    };
    const config = { ...getConfig({}), shipPort: 0, shipPath: '/ship/', announceShipService: false, shipServerEnabled: true,
        autoConnectEnabled: true, autoAcceptNewDevices: false, allowCommandsToUntrustedDevices: false, ...options.config };
    const endpoint = new ShipEndpoint(adapter, config, options.identity || local,
        async (id, payload) => delivered.push({ id, payload }),
        async node => { observed.push(node); if (options.onNode) await options.onNode(node); },
        async (...args) => { if (options.onState) await options.onState(...args); }, async id => ready.push(id), async () => {},
        async id => { if (options.isTrusted) return options.isTrusted(id, trusted); return trusted.has(id); });
    const clients = [];
    t.after(async () => {
        for (const client of clients) client.terminate();
        await endpoint.stop();
    });
    assert.equal(await endpoint.start(), true, 'loopback HTTPS endpoint started');
    const port = endpoint.server.address().port;
    async function connect(identity = peer) {
        const client = new WebSocket(`wss://127.0.0.1:${port}/ship/`, 'ship', {
            // Test peers intentionally use self-signed identities. The production
            // endpoint must perform the SHIP fingerprint checks under test.
            rejectUnauthorized: false,
            ...(identity ? { cert: identity.certificate, key: identity.privateKey } : {}),
            handshakeTimeout: 1000,
        });
        client.on('error', () => {});
        clients.push(client);
        await until(() => client.readyState !== WebSocket.CONNECTING, 'client TLS connection');
        return client;
    }
    function trust(identity = peer) {
        trusted.add(identity.ski);
        states.set(`devices.${identity.ski}.pairing.pinnedFingerprint`, { val: identity.fingerprint, ack: true });
    }
    return { endpoint, adapter, config, states, trusted, observed, delivered, ready, connect, trust, port, disable: () => { enabled = false; } };
}
async function handshake(f, socket, identity = peer) {
    await until(() => f.observed.some(node => node.ski === identity.ski), 'observed actual certificate');
    socket.send(encodeCmiFrame());
    socket.send(encodeControlFrame(makeHello('ready')));
    socket.send(encodeControlFrame(makeProtocolHandshake('announceMax')));
    socket.send(encodeControlFrame(makeProtocolHandshake('select')));
    await until(() => f.ready.includes(identity.ski), 'trusted SHIP data exchange');
}

test('EEBUS-SHIP-001: TLS client without certificate cannot become an observed or trusted device', { timeout: 5000 }, async t => {
    const f = await fixture(t);
    const client = await f.connect(null);
    await until(() => client.readyState === WebSocket.CLOSED, 'no-certificate peer rejected');
    assert.deepEqual(f.observed, []);
    assert.deepEqual(f.ready, []);
});

test('EEBUS-SHIP-002: unpaired data and an early PIN-none cannot bypass SHIP hello/protocol pairing', { timeout: 5000 }, async t => {
    const f = await fixture(t);
    const first = await f.connect();
    await until(() => f.observed.length > 0, 'peer observed');
    first.send(encodeDataFrame({ test: 'unpaired payload' }));
    await until(() => first.readyState === WebSocket.CLOSED, 'unpaired data rejected');
    const second = await f.connect();
    await until(() => f.observed.length > 1, 'reconnected peer observed');
    second.send(encodeControlFrame(makePinState('none')));
    await until(() => second.readyState === WebSocket.CLOSED, 'early PIN rejected');
    assert.equal(f.delivered.length, 0);
    assert.equal(f.ready.length, 0);
});

test('EEBUS-SHIP-003: matching paired certificate exchanges data and current central license blocks new sends', { timeout: 5000 }, async t => {
    const f = await fixture(t);
    f.trust();
    const client = await f.connect();
    await handshake(f, client);
    client.send(encodeDataFrame({ test: 'paired payload' }));
    await until(() => f.delivered.length === 1, 'paired application payload delivered');
    assert.equal(f.delivered[0].id, peer.ski);
    assert.equal(f.endpoint.sendSpine(peer.ski, { test: 'allowed output' }), true);
    f.disable();
    assert.equal(f.endpoint.sendSpine(peer.ski, { test: 'forbidden output' }), false);
    client.send(encodeDataFrame({ test: 'post-revocation input' }));
    await until(() => client.readyState === WebSocket.CLOSED, 'revoked license closes peer');
    assert.equal(f.delivered.length, 1);
});

test('EEBUS-SHIP-004: a trusted boolean with the wrong pinned certificate does not permit data exchange', { timeout: 5000 }, async t => {
    const f = await fixture(t);
    f.trusted.add(peer.ski);
    f.states.set(`devices.${peer.ski}.pairing.pinnedFingerprint`, { val: replacement.fingerprint, ack: true });
    const client = await f.connect();
    await until(() => f.observed.length > 0, 'peer observed');
    client.send(encodeCmiFrame());
    client.send(encodeControlFrame(makeHello('ready')));
    client.send(encodeControlFrame(makeProtocolHandshake('select')));
    await until(() => client.readyState === WebSocket.CLOSED, 'mismatched certificate pin rejected');
    assert.equal(f.ready.length, 0);
    assert.equal(f.delivered.length, 0);
});

test('EEBUS-SHIP-005: approving an unknown identity fails and explicit approval pins only the observed live certificate', { timeout: 5000 }, async t => {
    const f = await fixture(t);
    await assert.rejects(f.endpoint.approveDevice(peer.ski), /EEBUS_NO_OBSERVED_PEER/);
    const client = await f.connect();
    await until(() => f.observed.length > 0, 'peer observed');
    f.trusted.add(peer.ski);
    await f.endpoint.approveDevice(peer.ski);
    assert.equal(f.states.get(`devices.${peer.ski}.pairing.pinnedFingerprint`).val, peer.fingerprint);
    await handshake(f, client);
    assert.equal(f.ready.length, 1);
});

test('EEBUS-SHIP-006: outbound TLS certificate must match the advertised peer SKI', { timeout: 5000 }, async t => {
    const server = await fixture(t);
    const client = await fixture(t);
    const node = { id: replacement.ski, safeId: replacement.ski, ski: replacement.ski, host: '127.0.0.1',
        port: server.port, path: '/ship/', name: 'spoofed discovery', fingerprint: replacement.fingerprint };
    assert.equal(await client.endpoint.connectToNode(node), false);
    assert.equal(client.ready.length, 0);
    assert.equal(client.delivered.length, 0);
});

test('EEBUS-SHIP-007: replacing a peer connection does not let the old close event delete the new session', { timeout: 5000 }, async t => {
    const f = await fixture(t);
    f.trust();
    const first = await f.connect();
    await handshake(f, first);
    const second = await f.connect();
    await until(() => f.observed.length === 2 && first.readyState === WebSocket.CLOSED, 'old peer superseded');
    second.send(encodeCmiFrame());
    second.send(encodeControlFrame(makeHello('ready')));
    second.send(encodeControlFrame(makeProtocolHandshake('select')));
    await until(() => f.ready.length === 2, 'new session completed');
    assert.equal(f.endpoint.sendSpine(peer.ski, { test: 'new session remains available' }), true);
});

test('EEBUS-SHIP-008: central license revocation while trust lookup is pending prevents late application delivery', { timeout: 5000 }, async t => {
    let delayTrust = false;
    let unblock;
    const f = await fixture(t, { isTrusted: async (id, trusted) => {
        if (delayTrust) await new Promise(resolve => { unblock = resolve; });
        return trusted.has(id);
    } });
    f.trust();
    const client = await f.connect();
    await handshake(f, client);
    delayTrust = true;
    client.send(encodeDataFrame({ test: 'late application payload' }));
    await until(() => typeof unblock === 'function', 'trust lookup pending');
    f.disable();
    unblock();
    await until(() => client.readyState === WebSocket.CLOSED || f.delivered.length > 0, 'pending data resolved');
    assert.equal(f.delivered.length, 0, 'expired capability must be checked after async trust lookup');
});

test('EEBUS-SHIP-009: configured local PIN cannot be bypassed by remote PIN-none', { timeout: 5000 }, async t => {
    const f = await fixture(t, { config: { pairingPin: '123456' } });
    f.trust();
    const client = await f.connect();
    await until(() => f.observed.length > 0, 'peer observed');
    client.send(encodeCmiFrame());
    client.send(encodeControlFrame(makeHello('ready')));
    client.send(encodeControlFrame(makeProtocolHandshake('select')));
    client.send(encodeControlFrame(makePinState('none')));
    client.send(encodeDataFrame({ test: 'data without local PIN' }));
    await until(() => client.readyState === WebSocket.CLOSED, 'missing required local PIN rejected');
    assert.equal(f.ready.length, 0);
});

test('EEBUS-SHIP-011: peer asserting PIN-ok does not prove knowledge of the configured local PIN', { timeout: 5000 }, async t => {
    const f = await fixture(t, { config: { pairingPin: '123456' } });
    f.trust();
    const client = await f.connect();
    await until(() => f.observed.length > 0, 'peer observed');
    client.send(encodeCmiFrame());
    client.send(encodeControlFrame(makeHello('ready')));
    client.send(encodeControlFrame(makeProtocolHandshake('select')));
    client.send(encodeControlFrame(makePinState('pinOk')));
    client.send(encodeDataFrame({ test: 'data without local PIN knowledge' }));
    await until(() => client.readyState === WebSocket.CLOSED || f.ready.length > 0, 'PIN assertion evaluated');
    assert.equal(f.ready.length, 0);
});

test('EEBUS-SHIP-010: slow discovery persistence does not lose an immediately sent handshake', { timeout: 5000 }, async t => {
    let releaseDiscovery;
    const f = await fixture(t, { onNode: async () => new Promise(resolve => { releaseDiscovery = resolve; }) });
    f.trust();
    const client = await f.connect();
    await until(() => typeof releaseDiscovery === 'function', 'discovery persistence pending');
    client.send(encodeCmiFrame());
    client.send(encodeControlFrame(makeHello('ready')));
    client.send(encodeControlFrame(makeProtocolHandshake('select')));
    // Frames must be retained while metadata persistence is pending. Give the
    // network one turn to deliver before completing this independent backend.
    await new Promise(resolve => setTimeout(resolve, 20));
    releaseDiscovery();
    await until(() => f.ready.length > 0, 'queued handshake progresses after diagnostics');
    assert.equal(f.ready[0], peer.ski);
});

test('EEBUS-SHIP-012: both endpoint roles complete paired mutual TLS and exchange application data', { timeout: 5000 }, async t => {
    const server = await fixture(t, { identity: local });
    const client = await fixture(t, { identity: peer });
    server.trust(peer);
    client.trust(local);
    const node = { id: local.ski, safeId: local.ski, ski: local.ski, host: '127.0.0.1',
        port: server.port, path: '/ship/', name: 'paired endpoint', fingerprint: local.fingerprint };
    assert.equal(await client.endpoint.connectToNode(node), true);
    await until(() => server.ready.includes(peer.ski) && client.ready.includes(local.ski), 'mutual paired data exchange');
    assert.equal(client.endpoint.sendSpine(local.ski, { test: 'client to server' }), true);
    assert.equal(server.endpoint.sendSpine(peer.ski, { test: 'server to client' }), true);
    await until(() => server.delivered.some(row => row.payload?.data?.payload?.test === 'client to server') &&
        client.delivered.some(row => row.payload?.data?.payload?.test === 'server to client'), 'bidirectional payload delivery');
});

test('EEBUS-SHIP-013: stopping while discovery persistence is pending closes sockets promptly', { timeout: 5000 }, async t => {
    let release;
    const f = await fixture(t, { onNode: async () => new Promise(resolve => { release = resolve; }) });
    const client = await f.connect();
    await until(() => typeof release === 'function', 'discovery persistence pending');
    const started = performance.now();
    await f.endpoint.stop();
    assert.ok(performance.now() - started < 1000, 'stop does not wait for metadata DB indefinitely');
    await until(() => client.readyState === WebSocket.CLOSED, 'socket closed after stop');
    release();
    assert.equal(f.endpoint.sendSpine(peer.ski, { test: 'late send' }), false);
});

test('EEBUS-IDENTITY-001: installation identity persists with private permissions and corrupt storage is not silently replaced', { timeout: 5000 }, async () => {
    const { IdentityManager } = require('../build/lib/identityManager');
    const dataDir = join(fixtureDir, 'installation');
    const config = getConfig({});
    const initial = await new IdentityManager(dataDir, config).ensureIdentity();
    const restored = await new IdentityManager(dataDir, config).ensureIdentity();
    assert.equal(initial.privateKey, restored.privateKey);
    assert.equal(initial.localSki, restored.localSki);
    assert.equal(initial.shipId, restored.shipId);
    const filename = join(dataDir, 'ship-identity.json');
    assert.equal(statSync(filename).mode & 0o777, 0o600);
    assert.equal(statSync(dataDir).mode & 0o777, 0o700);
    writeFileSync(filename, '{broken');
    await assert.rejects(new IdentityManager(dataDir, config).ensureIdentity());
    assert.equal(readFileSync(filename, 'utf8'), '{broken');
});

test('EEBUS-SHIP-014: concurrent requests for the same peer cannot bypass the connection reservation during slow diagnostics', { timeout: 5000 }, async t => {
    let release;
    const delay = new Promise(resolve => { release = resolve; });
    const server = await fixture(t, { identity: local });
    const client = await fixture(t, { identity: peer, onState: async (_id, state) => { if (state === 'connecting') await delay; } });
    server.trust(peer); client.trust(local);
    const node = { id: local.ski, safeId: local.ski, ski: local.ski, host: '127.0.0.1',
        port: server.port, path: '/ship/', name: 'paired endpoint', fingerprint: local.fingerprint };
    const attempts = Array.from({ length: 8 }, () => client.endpoint.connectToNode(node));
    release();
    await Promise.all(attempts);
    await until(() => server.observed.length > 0, 'outbound peer observed');
    assert.equal(server.observed.length, 1, 'one connecting socket per peer, despite awaited diagnostics');
});

