'use strict';
/** Real loopback sockets and fault responses; this fixture does not execute Flux. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = process.env.EOS_AUDIT_SOURCE_ROOT || path.resolve(__dirname, '..');
const { InfluxHistoryRuntime } = require('tsx/cjs/api').require(path.join(root, 'ui/src-ts/runtime-executables/lib/influx-history-runtime.ts'), __filename);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, ms = 1000) {
    const deadline = performance.now() + ms;
    while (!predicate() && performance.now() < deadline) await pause(5);
    assert.ok(predicate(), 'condition must settle within its test deadline');
}
function sample(runtime, val) { runtime.commit(runtime.capture('historie.power', { val, ts: Date.now(), ack: true })); }
async function serverFixture(t, tls) {
    let mode = 'stall'; let active = 0, maxActive = 0;
    const sockets = new Set(); const requests = [];
    const server = (tls ? https.createServer.bind(https, tls) : http.createServer)(async (req, res) => {
        active++; maxActive = Math.max(maxActive, active); res.on('close', () => active--);
        let body = ''; for await (const chunk of req) body += chunk;
        requests.push({ path: req.url, body });
        if (mode === 'stall') return;
        if (mode === 'rate') { res.statusCode = 429; res.end('synthetic-secret-must-not-be-diagnostic'); return; }
        if (mode === 'badcsv' && req.url.startsWith('/api/v2/query')) { res.end('not-a-csv'); return; }
        if (req.url.startsWith('/api/v2/write')) { res.statusCode = 204; res.end(); }
        else res.end('');
    });
    server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const config = { provider: 'influxdb2', influxdb2: { url: `${tls ? 'https' : 'http'}://127.0.0.1:${server.address().port}/`,
        organization: 'test', bucket: 'test', token: 'synthetic-test-token', ...(tls ? { caCertificate: tls.cert } : {}) } };
    return { config, requests, sockets, mode: value => { mode = value; }, maxActive: () => maxActive };
}
function runtimeFixture(t, server) {
    const runtime = new InfluxHistoryRuntime('eos-admin.0'); runtime.register('historie.power'); runtime.configure(server.config);
    t.after(() => runtime.close()); return runtime;
}
test('921-HIS-003 sustained outage bounds read/write load and accounts for every rejected or cancelled sample', async t => {
    const server = await serverFixture(t); const runtime = runtimeFixture(t, server);
    const query = { start: 1, end: 2 };
    const reads = Promise.allSettled(Array.from({ length: 70 }, () => runtime.query('historie.power', query)));
    await assert.rejects(runtime.query('historie.power', query), /EOS_INFLUX_BUSY/);
    for (let i = 0; i < 2100; i++) sample(runtime, i);
    assert.equal(runtime.status().queueDepth, 2000); assert.equal(runtime.status().droppedPoints, 100);
    await until(() => server.requests.length >= 7);
    const result = await reads;
    assert.equal(result.length, 70);
    assert.ok(result.every(row => row.status === 'rejected' && /EOS_INFLUX_TIMEOUT/.test(row.reason.message)));
    assert.ok(server.maxActive() <= 7, 'six readers and one writer are the maximum active requests');
    assert.equal(runtime.status().writeVerified, false);
    runtime.close(); await until(() => server.sockets.size === 0);
    assert.equal(runtime.status().queueDepth, 0); assert.equal(runtime.status().droppedPoints, 2100);
});
test('921-HIS-003 repeated rate limits recover without retries, fake zeros or cleared independent read errors', async t => {
    const server = await serverFixture(t); const runtime = runtimeFixture(t, server); server.mode('rate');
    for (let cycle = 1; cycle <= 8; cycle++) {
        sample(runtime, cycle); await until(() => runtime.status().droppedPoints === cycle);
        assert.equal(server.requests.length, cycle, 'no hidden retry amplifies the failed write');
        assert.equal(runtime.status().writeError, 'EOS_INFLUX_RATE_LIMITED');
    }
    server.mode('badcsv');
    await assert.rejects(runtime.query('historie.power', { start: 1, end: 2 }), /EOS_INFLUX_RESPONSE_INVALID/);
    sample(runtime, 0); await until(() => runtime.status().writeVerified);
    assert.equal(runtime.status().readError, 'EOS_INFLUX_RESPONSE_INVALID');
    assert.equal(runtime.status().writeError, '');
    server.mode('good'); assert.deepEqual(await runtime.query('historie.power', { start: 1, end: 2 }), { result: [] });
    assert.equal(runtime.status().lastError, ''); assert.equal(runtime.status().droppedPoints, 8);
    assert.ok(server.requests.some(req => req.body.includes('value=0 ')), 'a real zero remains a valid observation');
    await runtime.drainAndClose(); await until(() => server.sockets.size === 0);
});
test('921-HIS-003 target replacement aborts old sockets and cannot forward pending history to the new bucket', async t => {
    const old = await serverFixture(t); const next = await serverFixture(t); next.mode('good');
    const runtime = runtimeFixture(t, old);
    sample(runtime, 11); await until(() => old.requests.length === 1);
    for (let i = 0; i < 199; i++) sample(runtime, 12);
    const read = runtime.query('historie.power', { start: 1, end: 2 }); const observed = Promise.allSettled([read]);
    await until(() => old.requests.length === 2);
    runtime.configure(next.config); sample(runtime, 22); await until(() => next.requests.length === 1);
    assert.equal((await observed)[0].status, 'rejected');
    await until(() => old.sockets.size === 0);
    assert.equal(runtime.status().droppedPoints, 200);
    assert.equal(next.requests.length, 1); assert.match(next.requests[0].body, /value=22 /);
    assert.doesNotMatch(next.requests[0].body, /value=1[12] /);
    await runtime.drainAndClose(); await until(() => next.sockets.size === 0);
});
test('921-HIS-003 TLS stalled writer is cancelled by the bounded drain and later reconfiguration succeeds', async t => {
    const forge = createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const certificate = forge.pki.createCertificate(); certificate.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    certificate.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`;
    certificate.validity.notBefore = new Date(Date.now() - 60000); certificate.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'localhost' }]; certificate.setSubject(subject); certificate.setIssuer(subject);
    certificate.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }]);
    certificate.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create());
    const server = await serverFixture(t, { key, cert: forge.pki.certificateToPem(certificate) });
    const runtime = runtimeFixture(t, server); sample(runtime, 3); await until(() => server.requests.length === 1);
    const started = performance.now(); await runtime.drainAndClose(50); await until(() => server.sockets.size === 0);
    assert.ok(performance.now() - started < 500); assert.equal(runtime.status().droppedPoints, 1);
    server.mode('good'); runtime.configure(server.config); sample(runtime, -0.05); await until(() => runtime.status().writeVerified);
    await runtime.drainAndClose(); await until(() => server.sockets.size === 0);
    assert.equal(runtime.status().queueDepth, 0); assert.equal(runtime.status().droppedPoints, 1);
});
